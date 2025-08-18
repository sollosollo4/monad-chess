import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Room } from "./Room";

@Entity()
export class Game {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Room)
  @JoinColumn()
  room!: Room;

  @Column()
  white!: string; // wallet address or user id string

  @Column()
  black!: string;

  @Column({ type: "text" })
  fen!: string; // текущее состояние в FEN

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}