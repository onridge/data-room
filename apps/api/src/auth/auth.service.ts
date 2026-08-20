import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import type { LoginTicket } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

// Fail closed on a missing client ID, same treatment as JWT_SECRET and
// WEB_ORIGIN. Without it `verifyIdToken` gets `audience: undefined`, which
// silently accepts a token minted for *any* Google app — an authentication
// bypass rather than a misconfiguration.
const getGoogleClientId = (): string => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not set');
  }
  return clientId;
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  async loginWithGoogle(idToken: string) {
    // verifyIdToken throws on anything it dislikes — expired token, wrong
    // audience, bad signature. Uncaught, that surfaced as a bare 500
    // "Internal server error" with nothing in the logs, which made a failing
    // Google sign-in impossible to diagnose from either end. The caller gets
    // a 401; the actual reason goes to the server log, not the response.
    // Resolved before the try, so a missing client ID surfaces as a server
    // error instead of being caught below and reported as a bad token.
    const audience = getGoogleClientId();

    let ticket: LoginTicket;
    try {
      ticket = await googleClient.verifyIdToken({ idToken, audience });
    } catch (error) {
      this.logger.warn(
        `Google ID token rejected: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Google sign-in failed');
    }

    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    let user = await this.prisma.user.findUnique({ where: { googleId: payload.sub } });

    // Someone who registered with email/password before is now signing in
    // with Google using the same email — link the accounts instead of
    // creating a duplicate.
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: payload.email } });
      user = byEmail
        ? await this.prisma.user.update({
            where: { id: byEmail.id },
            data: { googleId: payload.sub },
          })
        : await this.prisma.user.create({
            data: {
              email: payload.email,
              googleId: payload.sub,
              name: payload.name ?? payload.email,
            },
          });
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    // The user behind a still-valid JWT may have been deleted since the
    // token was issued — treat that the same as "not authenticated".
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toPublicUser(user);
  }

  private buildAuthResponse(user: AuthUser) {
    return {
      accessToken: this.jwt.sign({ sub: user.id, email: user.email }),
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: AuthUser) {
    return { id: user.id, email: user.email, name: user.name };
  }
}
