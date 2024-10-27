import bcrypt from "bcrypt";
import User from "../db/models/User";
import { SafeUser, signInParams, SignUpParams } from "../types/types";
import { CustomError } from "../errors/customError";
import { Op } from "sequelize";
import UserGroup from "../db/models/UserGroup";
import Group from "../db/models/Group";

const addUser = async ({
  username,
  password,
}: SignUpParams): Promise<SafeUser> => {
  try {
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username: username }],
      },
    });

    if (existingUser) {
      throw new CustomError("Username  already exists.", 400, true);
    }
    // made an instance of User to use it for validation before insertion
    const user = User.build({
      username,
      password: password,
    });
    await user.validate();

    const newUser = await User.create({
      username,
      password,
    });
    return newUser.omitFields(["password", "createdAt", "updatedAt"]);
  } catch (error) {
    throw error;
  }
};

const signInService = async ({
  username,
  password,
}: signInParams): Promise<SafeUser> => {
  try {
    const existingUser = await User.findOne({
      where: {
        username: username,
      },
      include: [
        {
          model: UserGroup,
          as: "groups",
        },
        {
          model: Group,
          as: "userGroup",
        },
      ],
    });
    if (!existingUser || password !== existingUser.password) {
      throw new CustomError("Invalid credentials", 401, true);
    }

    return existingUser.omitFields(["password", "createdAt", "updatedAt"]);
  } catch (error) {
    throw error;
  }
};

const getUserService = async (userId: number) => {
  try {
    const existingUser = await User.findByPk(userId, {
      include: [
        {
          model: UserGroup,
          as: "groups",
        },
        {
          model: Group,
          as: "userGroup",
        },
      ],
    });

    const userGroupMemebers = await UserGroup.findAll({
      where: { groupId: 1 },
    });
    // const userToLookFor = userGroupMemebers.map((user) =>
    //   user.get({ plain: true })
    // );

    const groupMemebers = [];

    userGroupMemebers.forEach(async (user) => {
      console.log("looking for", user.get());
      const maUser = await User.findByPk(user.get({ plain: true }).userId, {
        attributes: ["id", "username"],
      });
      console.log("found ", maUser);
      if (maUser) groupMemebers.push(maUser.get());
    });

    // console.log(groupMemebers);
    return existingUser!.get({ plain: true });
  } catch (error) {
    throw error;
  }
};

export { addUser, signInService, getUserService };
