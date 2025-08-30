import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { Game } from "./Game";

@Entity()
export class MoveAnalysis {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Game)
  game!: Game;

  @Column({ type: 'int' })
  moveNumber!: number;

  @Column()
  move!: string; // например e2e4q

  @Column()
  side!: string;

  @Column("text")
  fenBefore!: string;

  @Column("text")
  fenAfter!: string;

  @Column({ type: "int", nullable: true })
  evalBeforeCp!: number | null;

  @Column({ type: "int", nullable: true })
  evalAfterCp!: number | null;

  @Column({ type: "varchar", nullable: true })
  bestResponse!: string | null;

  @Column({ type: "varchar", default: "good" })
  severity!: string;

  @Column("simple-array", { nullable: true })
  pv!: string[]; // principal variation (основная линия движка)

  // комментарий от движка/LLM
  @Column("text", { nullable: true })
  engineComment!: string | null;

  @Column("text", { nullable: true })
  llmShort!: string | null;

  @Column("text", { nullable: true })
  llmHint!: string | null;

  @Column({ type: "varchar", nullable: true })
  llmTone!: "encourage" | "neutral" | "warn" | null;

  @Column("simple-array", { nullable: true })
  llmTags!: string[] | null;

  @CreateDateColumn()
  createdAt!: Date;
}