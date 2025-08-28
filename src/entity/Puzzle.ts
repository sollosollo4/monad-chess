import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("puzzles")
export class Puzzle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", nullable: true })
  lichessId?: string| null;

  @Column("text")
  fen!: string;

  // правильное решение в виде массива ходов UCI (например ["e2e4","e7e5"])
  @Column("text", { array: true })
  solution!: string[];

  @Column({ type: "int", nullable: true })
  rating?: number | null;

  // темы: mateIn2, pin, fork и т.д.
  @Column("text", { array: true, nullable: true })
  themes?: string[] | null;
}