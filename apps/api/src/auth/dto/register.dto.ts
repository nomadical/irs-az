import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@irs.az' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'fuzuli_fan' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Əli Həsənov', required: false })
  @IsString()
  name?: string;
}
