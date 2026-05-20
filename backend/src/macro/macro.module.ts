import { Module } from "@nestjs/common";
import { MacroService } from "./macro.service";
import { MacroController } from "./macro.controller";
@Module({ controllers: [MacroController], providers: [MacroService], exports: [MacroService] })
export class MacroModule {}
