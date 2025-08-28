// src/entity/LinkedWallet.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from "typeorm";
import { User } from "./User";

@Entity()
export class LinkedAccount {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  provider!: string; // "wallet" | "twitter" | "discord" | ...

  @Column()
  providerUserId!: string; // адрес кошелька, twitterId, discordId и т.д.

  @Column()
  address!: string;

  @Column()
  providerAppId!: string;

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: "CASCADE" })
  user!: User;
}