import { NextFunction, Response, Request } from "express";
import { CustomError } from "../errors/customError";
import WorkSpace from "../db/models/WorkSpace";
import Survey from "../db/models/Survey";
import UserGroup from "../db/models/UserGroup";
import {
  CustomEndingModel,
  DefaultEndingModel,
  NewCustomEnding,
  NewDefaultEnding,
  NewQuestion,
  UserGroupModel,
} from "../types/types";
import { validateWithSchema } from "../utils/validations/welcomeQuestion";
import { ZodError } from "zod";
import {
  getTranslation,
  makeImage,
  processCustomEndingData,
  processDefaultEndingData,
  processDefaultEndingOptions,
  processEditCustomEndingData,
  processEditDefaultEndingData,
} from "../utils";
import {
  customEndingSchema,
  defaultEndingSchema,
  editDefaultEndingSchema,
} from "../utils/validations/endings";
import DefaultEnding from "../db/models/DefaultEnding";
import CustomEnding from "../db/models/CustomEnding";
import Group from "../db/models/Group";

export const checkGroupMembership = async (
  req: Request<{ endingId: string; type: "default" | "custom" }, {}, {}>,
  res: Response<
    {},
    {
      groupId: string;
      userId: string;
      groupMembers?: UserGroupModel[];
    }
  >,
  next: NextFunction
) => {
  try {
    const { groupId, userId } = res.locals;
    console.log(res.locals ? "not empty" : "empty");
    const currentLang = (req.headers["accept-language"] as "en" | "de") ?? "en";

    const userGroupMembership = await UserGroup.findOne({
      where: {
        userId,
        groupId,
      },
    });
    const isGroupOwner = await Group.findOne({
      where: { id: groupId, maker: userId },
    });

    if (!userGroupMembership && !isGroupOwner) {
      return next(
        new CustomError(
          getTranslation(currentLang, "notAMemberOfGroup"),
          403,
          true,
          "notAMemberOfGroup"
        )
      );
    }

    const groupMembers = await UserGroup.findAll({
      where: { groupId },
    });

    res.locals.groupId = groupId;
    res.locals.groupMembers = groupMembers.map((group) =>
      group.get({ plain: true })
    );

    next();
  } catch (error) {
    next(error);
  }
};

export const checkWorkspaceExists = async (
  req: Request<
    { endingId: string; type: "default" | "custom" },
    {},
    { workspaceId: string; surveyId: string }
  >,
  res: Response<
    {},
    {
      workspaceId: string;
      userId: string;
      groupId: string;
      newEnding?: NewDefaultEnding | NewCustomEnding;
    }
  >,
  next: NextFunction
) => {
  const { workspaceId } = req.body;
  if (isNaN(+workspaceId) || +workspaceId < 1) {
    return next(
      new CustomError("Invalid workspace ID", 400, true, "workspaceNotFound")
    );
  }

  const workspace = await WorkSpace.findOne({
    where: { id: +workspaceId },
  });

  if (!workspace) {
    return next(new CustomError("Workspace not found", 404, true));
  }
  next();
};

export const checkSurveyExists = async (
  req: Request<
    {
      endingId: string;
      type: "default" | "custom";
      surveyId: string;
      workspaceId: string;
    },
    {},
    {
      surveyId: string;
      workspaceId: string;
    }
  >,
  res: Response<
    {},
    {
      workspaceId: string;
      userId: string;
      groupId: string;
    }
  >,
  next: NextFunction
) => {
  const { surveyId } = req.body;
  const currentLanguage =
    (req.headers["accept-language"] as "en" | "de") || "en";
  try {
    if (Number.isNaN(+surveyId)) {
      return next(
        new CustomError(
          getTranslation(currentLanguage, "unexpectedError"),
          400,
          true,
          "invalidSurveyId"
        )
      );
    }

    const survey = await Survey.findOne({
      where: { id: surveyId },
    });

    if (!survey) {
      return next(
        new CustomError(
          getTranslation(currentLanguage, "surveyNotFound"),
          404,
          true,
          "surveyNotFound"
        )
      );
    }

    next();
  } catch (error) {
    return next(error);
  }
};

export const validateNewEnding = async (
  req: Request<
    { endingId: string; type: "default" | "custom" },
    {},
    {
      workspaceId: string;
      surveyId: string;
      type: "default" | "custom";
      defaultEnding: boolean;
    }
  >,
  res: Response<
    {},
    {
      newEnding: NewDefaultEnding | NewCustomEnding;
      workspaceId: string;
      userId: string;
      groupId: string;
    }
  >,
  next: NextFunction
) => {
  const currentLang = (req.headers["accept-language"] as "en" | "de") || "en";
  try {
    const { defaultEnding, type } = req.body;
    const customEndingData = processCustomEndingData(req.body);
    const defaultEndingData = processDefaultEndingData(req.body);
    const defaultEndingOptions = processDefaultEndingOptions(req.body);
    const defaultSchema = defaultEndingSchema(defaultEndingOptions);
    const customSchema = customEndingSchema(defaultEnding);

    if (type === "custom") {
      customSchema.parse(customEndingData);
      res.locals.newEnding = customEndingData;
    } else {
      defaultSchema.parse(defaultEndingData);

      if (defaultEndingData.imageUrl) {
        const imageUrl = makeImage(defaultEndingData.imageUrl);
        res.locals.newEnding = { ...defaultEndingData, imageUrl };
      } else {
        res.locals.newEnding = defaultEndingData;
      }
    }

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const validationErrors = validateWithSchema(error, currentLang);
      next(
        new CustomError(
          "Validation Error",
          400,
          true,
          "validationError",
          "",
          validationErrors
        )
      );
    } else {
      console.log(error);
      next(
        new CustomError(
          getTranslation(currentLang, "surveyNotFound"),
          500,
          true,
          "unknownError",
          ""
        )
      );
    }
  }
};

export const checkEndingExists = async (
  req: Request<
    { endingId: string },
    {},
    {
      workspaceId: string;
      surveyId: string;
      type: "default" | "custom";
      defaultEnding: boolean;
    }
  >,
  res: Response<
    {},
    {
      newEnding?: NewDefaultEnding | NewCustomEnding;
      workspaceId: string;
      userId: string;
      groupId: string;
      ending: DefaultEndingModel | CustomEndingModel;
    }
  >,
  next: NextFunction
) => {
  const currentLang = (req.headers["accept-language"] as "en" | "de") || "en";
  try {
    const { endingId } = req.params;
    const { type } = req.body;

    if (type === "custom") {
      const customEnding = await CustomEnding.findOne({
        where: { id: endingId },
      });

      if (!customEnding) {
        return next(
          new CustomError(
            "Custom ending not found",
            404,
            true,
            "endingNotFound"
          )
        );
      }

      res.locals.ending = customEnding.get();
    } else if (type === "default") {
      const defaultEnding = await DefaultEnding.findOne({
        where: { id: endingId },
      });

      if (!defaultEnding) {
        return next(
          new CustomError(
            getTranslation(currentLang, "endingNotFound"),
            404,
            true,
            "endingNotFound"
          )
        );
      }

      res.locals.ending = defaultEnding.get();
    } else {
      return next(
        new CustomError(
          getTranslation(currentLang, "unexpectedError"),
          400,
          true,
          "invalidType"
        )
      );
    }

    next();
  } catch (error) {
    console.log(error);
    return next(
      new CustomError(
        getTranslation(currentLang, "unexpectedError"),
        500,
        true,
        "internalServerError"
      )
    );
  }
};

export const validateEditEnding = async (
  req: Request<
    { endingId: string; type: "default" | "custom" },
    {},
    {
      workspaceId: string;
      surveyId: string;
      type: "default" | "custom";
      defaultEnding: boolean;
    }
  >,
  res: Response<
    {},
    {
      newEnding: NewDefaultEnding | NewCustomEnding;
      editEnding: DefaultEndingModel | CustomEndingModel;
      workspaceId: string;
      userId: string;
      groupId: string;
    }
  >,
  next: NextFunction
) => {
  const currentLang = (req.headers["accept-language"] as "en" | "de") || "en";

  try {
    const { defaultEnding, type } = req.body;
    const customEndingData = processEditCustomEndingData(req.body);
    const defaultEndingData = processEditDefaultEndingData(req.body);
    const defaultEndingOptions = processDefaultEndingOptions(req.body);

    const defaultSchema = editDefaultEndingSchema(defaultEndingOptions);
    const customSchema = customEndingSchema(defaultEnding);

    if (type === "custom") {
      customSchema.parse(customEndingData);
      res.locals.editEnding = customEndingData as CustomEndingModel;
    } else {
      defaultSchema.parse(defaultEndingData);

      if (
        defaultEndingData.imageUrl !== null &&
        defaultEndingData.imageUrl !== undefined &&
        typeof defaultEndingData.imageUrl === "string" &&
        !defaultEndingData.imageUrl.includes("\\uploads\\")
      ) {
        const imageUrl = makeImage(defaultEndingData.imageUrl);
        res.locals.editEnding = {
          ...defaultEndingData,
          imageUrl,
        } as DefaultEndingModel;
      } else {
        res.locals.editEnding = defaultEndingData as DefaultEndingModel;
      }
    }

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const validationErrors = validateWithSchema(error, currentLang);
      next(
        new CustomError(
          "Validation Error",
          400,
          true,
          "validationError",
          "",
          validationErrors
        )
      );
    } else {
      next(
        new CustomError(
          getTranslation(currentLang, "unexpectedError"),
          500,
          true,
          "unknownError",
          ""
        )
      );
    }
  }
};
