import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class Bot {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  rating!: number;

  @Column()
  avatar!: string;
}

export const seedBotsForCreating = [
  {
    name: "MIKEWEB",
    rating: 2700,
    avatar: "https://robohash.org/MIKEWEB.png",
  },
  {
    name: "bill monady",
    rating: 2400,
    avatar: "https://robohash.org/billmonady.png",
  },
  {
    name: "port",
    rating: 2300,
    avatar: "https://robohash.org/port.png",
  },
  {
    name: "PaulC",
    rating: 2200,
    avatar: "https://robohash.org/PaulC.png",
  },
  {
    name: "tunez",
    rating: 2100,
    avatar: "https://robohash.org/tunez.png",
  },
  {
    name: "physecks",
    rating: 2000,
    avatar: "https://robohash.org/physecks.png",
  },
  {
    name: "onlinelink",
    rating: 1900,
    avatar: "https://robohash.org/onlinelink.png",
  },
  {
    name: "whitesocks",
    rating: 1800,
    avatar: "https://robohash.org/whitesocks.png",
  },
  {
    name: "botty",
    rating: 1600,
    avatar: "https://robohash.org/botty.png",
  },
  {
    name: "Chogstar",
    rating: 1200,
    avatar: "https://robohash.org/Chogstar.png",
  },
];
