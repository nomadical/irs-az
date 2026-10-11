import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const existingUsername = await this.users.findByUsername(dto.username);
    if (existingUsername) throw new ConflictException('Username taken');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.create({
      email: dto.email,
      username: dto.username,
      name: dto.name,
      passwordHash,
    });

    return this.issueTokens(user.id, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.isBanned) throw new UnauthorizedException('Account banned');

    return this.issueTokens(user.id, user.role);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
      return this.issueTokens(payload.sub, payload.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private issueTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: this.jwt.sign(payload, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
      }),
    };
  }
}
