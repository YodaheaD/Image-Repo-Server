import { Router } from "express";
import express, { Express, Request, Response } from "express";
import Jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { AuthTable, authProps } from "../db/auth";
import { isEmpty } from "lodash";
import Logger from "../utils/logger";
import cors from "cors";
import bodyParser from "body-parser";
import { pusherServer } from "../utils/pusher";
import { decodeUser } from "../utils/helpers";
// - JWT Auth --\\
export interface ReqParam extends Request {
  user?: string;
}
export const authRouter: Router = Router();

authRouter.use(cors());
authRouter.use(express.json());
authRouter.use(bodyParser.json());

// -> 'Users' array with hold users email and encrypted passwords.
let users: any[] = [];

// -> All routes have restricted access to only authorized users by adding the 'verifyUserToken' function as a middleware.

// -> This route will return the list of registered users and their hashed passwords.
authRouter.get(
  "/usersList",

  async (req: any, res: Response, next: any) => {
    res.json(users); //-> Return the user's information
  }
);
// -> This route is for clearing the list of register user's data/
authRouter.get(
  "/CLEARusers",

  async (req: any, res: Response, next: any) => {
    users = [];
    res.json(`Users list emptied : ${isEmpty(users)}`); // If users list is empty: returns True
  }
);

// -> The route is for registering a new user.
// -> The User email and password as taken in request, then check if user exists, then registers
// --- user's data with a hashed password.
authRouter.post("/register", async (req, res) => {
  const { user } = req.body;
  const username = user.email;
  const password = user.password;
  Logger.warn(
    ` Current registered users to Local data... \n -> Data: ${JSON.stringify(
      users
    )}`
  );
  Logger.info(
    `Registering new user... \n -> Email: ${username} \n -> Password: ${password}`
  );
  try {
    if (!user.email || !user.password) {
      return res.status(400).send("Username and password are required.");
    }

    // -> Function that checks if User already registered in data table.
    const doesUserExist = await AuthTable.checkUserExists(user.email);
    const orgPassword = user.password;
    //-> If User does not exist, create a new entry.
    // --- The password is hashed and reassigned.
    // --- The 'users' array contains the users information.
    if (doesUserExist === false) {
      const hash = await bcrypt.hash(user.password, 10);
      user.password = hash;
      Logger.info(
        `Registering new user to Local data... \n -> Data: ${JSON.stringify(
          users
        )}`
      );
      users.push(user);

      // await AuthTable.updateHashed(user.email, user.password,hash); // Update the hashed password in the data table.
      // Creating object that has user's data for the Table.
      const authFormat: authProps = {
        partitionKey: "PKey-" + user.email, //
        rowKey: "RKey-" + user.email,
        username: user.email,
        password: orgPassword,
        hashed: user.password,
        token: "Unassigned",
        isLoggedIn: "Logged Out",
      };
      // After all is finished, add User's information to the Authentication table.
      await AuthTable.insertEntity(authFormat); //
      Logger.info(
        `\n New User Registered: \n -> Email: ${authFormat.username} \n -> Password: ${authFormat.password}  \n -> Hashed: ${authFormat.hashed} \n -> Token: ${authFormat.token}`
      ); // Log the user's registration.
      res.json(user); // Return the data to the user.
    } else {
      // If user already found.//
      res.json(
        `User already registered with username: ${user.email} : Try Again`
      );
    }
  } catch (err) {
    Logger.error("Error registering user: " + err);
    res.status(400).send("Error registering user: " + err);
  }
}); //

// -> This function is for logging in for registered users, using an email and password.
authRouter.post("/login", async (req, res) => {
  Logger.info("User Login Requested" + JSON.stringify(req.body));
  Logger.warn(
    ` Current registered users to Local data... \n -> Data: ${JSON.stringify(
      users
    )}`
  );
  const { user } = req.body;

  // -> First, we check if the users exist in the user's array.//
  // checking if user exists in 'users' array.
  const doesUserExist = await AuthTable.checkUserExists(user.email);
  // -> When the user satisfies all checks, sign a JWT token for the user.

  // const token = Jwt.sign({ user }, String(process.env.JWT_SECRET), {
    const token = Jwt.sign({ email:user.email }, String(process.env.JWT_SECRET), {

    expiresIn: "1h",
  });

  try {
    // -> Updating the user's token in their data entry. //
    const TokenUpdateResp = await AuthTable.updateToken(
      user.email,
      user.password,
      token
    );
    const username = user.email;

    await pusherServer.trigger("my_channel", "my_event", {
      data: { username, token },
    }); ////

    Logger.info(
      `--> Token Updated for User ${user.email} \n\n *** User ${user.email} Logged in Successfully ! ***`
    );
    // Returning a message to user.
    res.json({ token, username });
    //res.json(`Inserted data: ${JSON.stringify(TokenUpdateResp)}`);//
  } catch (err) {
    Logger.error("Error with Token process: " + err);
    return res.status(500).send("Error with Token process: " + err); ////
  }
});

authRouter.post("/users", async (req: Request, res: Response) => {
  const { compare } = req.body;
  try {
    const { email } = users.find((item) => item.email === compare.email);
    const { password } = users.find((item) => item.email === compare.email);

    res.json("Done" + email + "\n The password" + password);
  } catch (err) {
    res.json(err);
  } //
});

// -> This route is for logging out a user.
authRouter.post("/logout", async (req: Request, res: Response) => {
  const { username } = req.body;
  Logger.http(`Logging out user: ${username}`);
   // -> Updating the user's token in their data entry to Logged Out.
   const response = await AuthTable.updateTokenNoAuth(username);
   res.json("Done loggin out. ");
});

