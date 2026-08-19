import { IsEmail } from 'class-validator';

export class AddGrantDto {
  @IsEmail()
  email: string;
}
