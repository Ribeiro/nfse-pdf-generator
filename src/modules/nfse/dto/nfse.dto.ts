import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class NfseDto {
  @IsString()
  @IsNotEmpty()
  xml!: string;

  @IsOptional()
  @IsIn(['single', 'multiple'])
  mode?: 'single' | 'multiple';

  @IsOptional()
  @IsString()
  zipName?: string;
}
