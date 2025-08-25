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

  @Column()
  monad_games_id!: boolean;

  @OneToMany(() => LinkedWallet, (wallet) => wallet.user, { cascade: true })
  wallets!: LinkedWallet[];

  @Column({ type: "int", default: 1200 })
  rating!: number;

  @Column({ type: "int", default: 500 })
  puzzleRating!: number;
}