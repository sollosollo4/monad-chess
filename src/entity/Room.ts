import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export type RoomMode = "pvp" | "bot";
export type Side = "white" | "black" | "random";
@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string; // short code

  @Column({  type: "varchar", nullable: true })
  name?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "varchar", default: "pvp" })
  mode!: RoomMode;

  @Column({ type: "varchar", default: "random" })
  adminSide!: Side;

  @Column({ type: "int", nullable: true })
  botRating?: number|null;
}
