import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { User } from "./User";
import { AppDataSource } from "../config/database";
import { isValidAddress, updatePlayerData } from "../services/blockchain";

const XP_VALUES: Record<ExperienceType, number> = {
  register: 500,
  daily_checkin: 100,
  puzzle_solved: 300,
  game_played: 500,
  achievement: 1000,
};

export type ExperienceType =
  | "register"
  | "daily_checkin"
  | "puzzle_solved"
  | "game_played"
  | "achievement";

@Entity()
export class UserExperience {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { nullable: false })
  user!: User;

  @Column({ type: "varchar" })
  type!: ExperienceType;

  @Column({ type: "int" })
  amount!: number;

  @Column({ type: "boolean", default: false })
  submitted!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "varchar", nullable: true })
  transactionHash!: string;

  public static async give(userId: number, event: ExperienceType) {
    const userRepo = AppDataSource.getRepository(User);
    const userExp = AppDataSource.getRepository(UserExperience);
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) return;
    const xp = userExp.create({
      user,
      type: event,
      amount: XP_VALUES[event],
      submitted: false,
    });
    await userExp.save(xp);
    try {
      if (user.monad_games_id) {
        const playerAddress = user.accounts
          .filter((x) => x.provider == "monad")
          .pop()?.providerUserId;
        if (!playerAddress || !isValidAddress(playerAddress)) {
          return;
        }
        const result = await updatePlayerData(
          playerAddress,
          XP_VALUES[event],
          1
        );
        if (result.hash) {
          xp.submitted = true;
          xp.transactionHash = result.hash;
          await userExp.save(xp);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
}
