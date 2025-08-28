import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { Game } from "./Game";
import { User } from "./User";
import { Bot } from "./Bot";

export type GameResult = "w" | "l" | "d"; // win / lose / draw
export type Side = "white" | "black";

@Entity()
export class UserGameResult {
   @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Game, { nullable: false })
  game!: Game;

  @ManyToOne(() => User, { nullable: false })
  user!: User;

  @ManyToOne(() => User, { nullable: true })
  enemy!: User | null;

  @Column({ default: false })
  is_bot!: boolean;

  @ManyToOne(() => Bot, { nullable: true })
  bot!: Bot | null;

  @Column({ type: "varchar" })
  result!: string; // 'w' | 'l' | 'd'

  @Column({ type: "varchar", nullable: true })
  color!: string | null; // (white / black)

  @CreateDateColumn()
  createdAt!: Date;
}
