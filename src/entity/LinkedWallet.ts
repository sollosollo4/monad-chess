// src/entity/LinkedWallet.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from "typeorm";
import { User } from "./User";

@Entity()
export class LinkedWallet {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  address!: string;

  @Column()
  providerAppId!: string;

  @ManyToOne(() => User, (user) => user.wallets, { onDelete: "CASCADE" })
  user!: User;
}