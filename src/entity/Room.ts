import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string; // short code

  @Column({ nullable: true })
  name?: string;

  @CreateDateColumn()
  createdAt!: Date;
}