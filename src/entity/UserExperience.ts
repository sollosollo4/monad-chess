import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { User } from "./User";
import { AppDataSource } from "../config/database";

const XP_VALUES: Record<ExperienceType, number> = {
    register: 500,
    daily_checkin: 100,
    puzzle_solved: 300,
    game_played: 500,
    achievement: 1000,
}

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

  public static async give(userId: number, event: ExperienceType) {
    const userRepo = AppDataSource.getRepository(User);
    const userExp = AppDataSource.getRepository(UserExperience);
    const user = await userRepo.findOneBy({ id: userId });
    if(!user) return;
    const xp = userExp.create({
        user,
        type: event,
        amount: XP_VALUES[event],
        submitted: false,
    });
    await userExp.save(xp);
  }
}