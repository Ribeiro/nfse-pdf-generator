/* eslint-disable @typescript-eslint/no-unsafe-call */
import 'reflect-metadata';
import { IsString, IsNotEmpty } from 'class-validator';

export class NfseDto {
  @IsString()
  @IsNotEmpty()
  xml!: string;
}
