import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from "typeorm";
import { LinkedAccount } from "./LinkedAccount";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column()
  monad_games_id!: boolean;

  @OneToMany(() => LinkedAccount, (account) => account.user, { cascade: true })
  accounts!: LinkedAccount[];

  @Column({ type: "int", default: 1200 })
  rating!: number;

  @Column({ type: "int", default: 500 })
  puzzleRating!: number;

  @Column({type: "int", default: 5})
  updateRatingCalls!: number;
}