import { Module } from '@nestjs/common';
import { AlphaService } from './alpha.service';
import { AlphaController } from './alpha.controller';
@Module({ controllers:[AlphaController], providers:[AlphaService], exports:[AlphaService] })
export class AlphaModule {}
