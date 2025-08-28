import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { Puzzle } from "./Puzzle";
import { User } from "./User";

@Entity()
export class UserPuzzleResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Puzzle)
  puzzle!: Puzzle;

  @ManyToOne(() => User)
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}
