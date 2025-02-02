import { Response, Request, NextFunction } from "express";
import { NewGroup, UserGroupModel, UserModel } from "../types/types";
import { CustomError } from "../errors/customError";
import User from "../db/models/User";
import UserGroup from "../db/models/UserGroup";
import { connect } from "http2";
import { Op } from "sequelize";
import { getTranslation } from "../utils";
import WorkspaceGroup from "../db/models/WorkspaceGroup";
import WorkSpace from "../db/models/WorkSpace";
import Group from "../db/models/Group";

export const NewGroupValidation = async (
  req: Request<{}, {}, NewGroup>,
  res: Response<{}, { groupData: NewGroup }>,
  next: NextFunction
) => {
  try {
    const { invitedUsers, groupName } = req.body;

    if (
      !Array.isArray(invitedUsers) ||
      invitedUsers.length === 0 ||
      typeof groupName !== "string"
    ) {
      throw new CustomError("Invalid invited users", 400, true);
    }

    await Promise.all(
      invitedUsers.map(async (id) => {
        const user = await User.findByPk(id);
        if (!user) {
          throw new CustomError(`User not found`, 404, true);
        }
      })
    );

    res.locals.groupData = req.body;
    next();
  } catch (error) {
    next(error);
  }
};

export const checkGroupMembership = async (
  req: Request<
    { surveyId: string; workspaceId: string },
    {},
    {
      isActive: boolean;
      title: string;
      targetWorkspaceId: string;
      workspaceId: string;
    }
  >,
  res: Response<
    {},
    {
      userGroupIds: number[];
      userId: string;
      groupMembers?: UserGroupModel[];
      workspaceOwner?: string;
    }
  >,
  next: NextFunction
) => {
  try {
    console.log("in checkGroupMembership");
    const { userGroupIds, userId, workspaceOwner } = res.locals;
    const { workspaceId } = req.body;
    const { workspaceId: fromParams } = req.params;
    const finalWorkspaceId = workspaceId || fromParams;
    const currentLang = (req.headers["accept-language"] as "en" | "de") ?? "en";

    const workspace = await WorkSpace.findOne({
      where: { id: finalWorkspaceId },
    });

    if (!workspace) {
      return next(
        new CustomError(
          getTranslation(currentLang, "workspaceNotFound"),
          404,
          true,
          "workspaceNotFound"
        )
      );
    }
    console.log("in membership user group ids", userGroupIds);
    if (userGroupIds.length === 0) {
      return next(
        new CustomError(
          getTranslation(currentLang, "notAMemberOfAnyGroup"),
          403,
          true,
          "notAMemberOfAnyGroup"
        )
      );
    }
    console.log({ workspaceId: workspace.id, groupId: userGroupIds });
    const hasAccess = await WorkspaceGroup.findOne({
      where: { workspaceId: workspace.id, groupId: userGroupIds },
    });

    if (!hasAccess) {
      return next(
        new CustomError(
          "No Access to this workspace",
          403,
          true,
          "accessDeniedToWorkspace"
        )
      );
    }

    const userGroup = await Group.findOne({
      where: { maker: workspaceOwner },
    });

    const groupMembers = await UserGroup.findAll({
      where: { groupId: userGroup?.id },
    });

    res.locals.userGroupIds = userGroupIds;
    res.locals.groupMembers = groupMembers.map((member) =>
      member.get({ plain: true })
    );

    console.log(
      "check group membership done here are the group members",
      res.locals.groupMembers
    );
    next();
  } catch (error) {
    next(error);
  }
};

export const lookForUserInGroup = async (
  req: Request<
    { surveyId: string; workspaceId: string },
    {},
    {
      username: string;
      userId: number;
      groupId: number;
      groupName: string;
    }
  >,
  res: Response<
    {},
    { groupId: string; userId: string; incomingMember?: UserGroupModel }
  >,
  next: NextFunction
) => {
  try {
    const lanuage = (req.headers["accept-language"] as "en" | "de") ?? "en";
    const { userId, groupId } = req.body;

    const userGroupMembership = await UserGroup.findOne({
      where: {
        [Op.or]: {
          userId,
        },
        groupId,
      },
    });

    if (!userGroupMembership) {
      return next(
        new CustomError(
          getTranslation(lanuage, "notAMemberOfGroup"),
          403,
          true,
          "notAMemberOfGroup"
        )
      );
    }
    res.locals.groupId = userGroupMembership.groupId.toString();
    res.locals.incomingMember = userGroupMembership.get({ plain: true });
    next();
  } catch (error) {
    throw error;
  }
};

export const findUser = async (
  req: Request<
    { surveyId: string; workspaceId: string },
    {},
    {
      username: string;
      userId: number;
      groupId: number;
      groupName: string;
    }
  >,
  res: Response<{}, { groupId: string; userId: string; user?: UserModel }>,
  next: NextFunction
) => {
  try {
    const lanuage = (req.headers["accept-language"] as "en" | "de") ?? "en";
    const { username, groupId } = req.body;
    const { userId: maker } = res.locals;

    const user = await User.findOne({
      where: {
        [Op.or]: {
          username,
        },
      },
    });

    if (!user) {
      return next(
        new CustomError(
          getTranslation(lanuage, "userNotFound"),
          404,
          true,
          "userNotFound"
        )
      );
    }

    if (+maker === +user.id) {
      return next(
        new CustomError(
          getTranslation(lanuage, "cantinviteYourSelf"),
          403,
          true,
          "selfInvite"
        )
      );
    }
    const isUserInTheGroup = await UserGroup.findOne({
      where: {
        userId: user.id,
        groupId,
      },
    });

    if (isUserInTheGroup) {
      return next(
        new CustomError(
          getTranslation(lanuage, "userIsAlreadyAMember"),
          403,
          true,
          "UserAlreadyInGroup"
        )
      );
    }
    res.locals.user = user.get({ plain: true });
    next();
  } catch (error) {
    throw error;
  }
};
