import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { Game } from "./Game";

@Entity()
export class Move {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Game)
  @JoinColumn()
  game!: Game;

  @Column()
  from!: string; // e.g. "e2"

  @Column()
  to!: string; // e.g. "e4"

  @Column()
  san!: string; // SAN или строка хода

  @Column()
  by!: string; // wallet who moved

  @CreateDateColumn()
  createdAt!: Date;
}