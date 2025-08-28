import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, JoinColumn, OneToOne } from "typeorm";
import { Room } from "./Room";

@Entity()
export class Game {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => Room)
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

  @Column({ type: "int", default: 300 }) // 5 минут, например
  whiteTime!: number;

  @Column({ type: "int", default: 300 })
  blackTime!: number;

  @Column({ type: "int", default: 0 }) // при желании инкремент (например +2 сек)
  increment!: number;

  @Column({ type: "bigint", nullable: true }) 
  lastMoveAt!: number | null; // timestamp последнего хода
}