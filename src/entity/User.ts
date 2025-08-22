import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from "typeorm";
import { LinkedWallet } from "./LinkedWallet";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column({ unique: true })
  monad_games_id!: boolean;

  @OneToMany(() => LinkedWallet, (wallet) => wallet.user, { cascade: true })
  wallets!: LinkedWallet[];

  @Column({})
  rating!: number;
}