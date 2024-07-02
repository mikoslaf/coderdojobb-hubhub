import { users } from "../drizzle/schema";
import { Database } from "../common";
import { InferInsertModel, InferSelectModel, eq } from "drizzle-orm";
import { MailerService } from "../common/mailer";
import { v4 as uuid } from "uuid";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export class UsersService {
  constructor(
    private readonly db: Database,
    private readonly mailerService: MailerService
  ) {}

  async getAllUsers() {
    return this.db.select().from(users);
  }

  async getUserById(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));

    if (!user) {
      return null;
    }

    return user;
  }

  async getUserByEmail(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return null;
    }

    return user;
  }

  async deleteUserById(id: string) {
    return this.db.delete(users).where(eq(users.id, id));
  }

  async createUser(
    user: InferInsertModel<typeof users>
  ): Promise<InferSelectModel<typeof users>> {
    const [newUser] = await this.db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(
    id: string,
    updateData: {
      email: string;
      firstName: string;
      lastName: string;
    }
  ) {
    const [user] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      return null;
    }

    return user;
  }

  async register(data: { email: string; password: string }) {
    const { hash: hashedPassword, salt: saltPassword } = hashPassword(data.password)
    const user = await this.createUser({
      id: uuid(),
      email: data.email,
      firstName: "aa",
      lastName: "bb",
      hashedPassword,
      saltPassword,
    });

    await this.mailerService.sendEmail({
      to: data.email,
      subject: "Welcome to HubHub!",
      text: "Welcome to HubHub! We're excited to have you on board.",
    });

    return user;
  }

  async logIn(data: { email: string; password: string }) {
    const user = await this.getUserByEmail(data.email);
    
    if(!user) {
      throw new Error("User not Exists");
    }

    const { hash: hashedPassword } = hashPassword(data.password, user.saltPassword);

    if(hashedPassword !== user.hashedPassword) {
      throw new Error("Wrong password");
    } 

    process.env.SECRET = "SECRET" // zmienić to!
    if(!process.env.SECRET) {
      throw new Error("500");
    }

    return {token: jwt.sign({ id: user.id }, process.env.SECRET), user: user};
  }
}

const config = {
  hashBytes: 32,
  saltBytes: 16,
  iterations: 872791,
  digest: "sha512"
};

function hashPassword(password: string, salt?: string) {
  const { iterations, hashBytes, digest, saltBytes } = config;
  if(!salt) {
    salt = crypto.randomBytes(saltBytes).toString("hex");
  }
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, hashBytes, digest)
    .toString("hex");
  return { salt, hash };
}
