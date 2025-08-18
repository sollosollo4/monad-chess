import { DataSource } from 'typeorm';
import { ENV } from '../config/env';
import { User } from '../entity/User';
import { LinkedWallet } from '../entity/LinkedWallet';
import { Game } from '../entity/Game';
import { Room } from '../entity/Room';
import { Move } from '../entity/Move';
import { Puzzle } from '../entity/Puzzle';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: ENV.database.host,
  port: ENV.database.port,
  username: ENV.database.username,
  password: ENV.database.password,
  database:ENV.database.database,
  entities: [User, Game, Room, Move, LinkedWallet, Puzzle],
  synchronize: true, // В проде false и миграции
});

export const initDb = async () => {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');
  } catch (error) {
    console.error(`DB init error, ${error}`);
  }
};
