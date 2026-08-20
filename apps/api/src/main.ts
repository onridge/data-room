import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Prisma maps BigInt columns (File.sizeBytes) to JS bigint, which
// JSON.stringify throws on by default — Express has no other hook for this.
declare global {
  interface BigInt {
    toJSON(): number;
  }
}
BigInt.prototype.toJSON = function (this: bigint) {
  return Number(this);
};

// Fail closed rather than falling back to a permissive default: a missing
// WEB_ORIGIN used to mean "allow any origin", so one misconfigured deploy
// would silently open the API to every site. Same treatment as JWT_SECRET.
const getWebOrigin = (): string => {
  const origin = process.env.WEB_ORIGIN;
  if (!origin) {
    throw new Error('WEB_ORIGIN is not set');
  }
  return origin;
};

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);

  // Railway terminates TLS and proxies to us, so the TCP peer is always its
  // edge, never the caller. Without this the rate limiter keys every request
  // on the same proxy address — and in practice that address varies per
  // request, so each one looked like a brand new client and the auth limit
  // never triggered in production even though it worked locally.
  // Trusting exactly one hop makes req.ip the last entry the proxy appended
  // to X-Forwarded-For, which a client cannot forge by sending its own
  // header.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({ origin: getWebOrigin() });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
};
bootstrap();
