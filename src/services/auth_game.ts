import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/database";
import { User } from "../entity/User";
import { ENV } from "../config/env";

export class AuthService {
  private userRepo = AppDataSource.getRepository(User);

  async authenticate(token: string) {
    const payload: any = jwt.verify(token, ENV.jwt_secret);
    const user = await this.userRepo.findOneOrFail({
      where: { id: payload.userId },
    });
    return user;
  }
}