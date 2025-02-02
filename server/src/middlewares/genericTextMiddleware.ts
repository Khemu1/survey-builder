import { NextFunction, Response, Request } from "express";
import { CustomError } from "../errors/customError";
import WorkSpace from "../db/models/WorkSpace";
import Survey from "../db/models/Survey";
import UserGroup from "../db/models/UserGroup";
import {
  editQuestion,
  GenericTextModel,
  NewQuestion,
  NewQuestionOptions,
  NewWelcomePart,
  UserGroupModel,
} from "../types/types";
import { validateWithSchema } from "../utils/validations/welcomeQuestion";
import { ZodError } from "zod";
import {
  getTranslation,
  makeImage,
  processEditQuestionData,
  processNewQuestionOptions,
  processQuestionData,
} from "../utils";
import {
  editGenericTextSchema,
  genericTextSchema,
} from "../utils/validations/genericText";
import GenericText from "../db/models/GenericText";
import GeneralRegex from "../db/models/GeneralRegex";
import GeneralText from "../db/models/GeneralText";
import Group from "../db/models/Group";

export const checkGroupMembership = async (
  req: Request<
    { questionId: string },
    {},
    {
      workspaceId: string;
      surveyId: string;
      newQuestion: NewQuestion;
      options: NewQuestionOptions;
    }
  >,
  res: Response<
    {},
    { groupId: string; userId: string; groupMembers?: UserGroupModel[] }
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
export const checkSurveyExists = async (
  req: Request<
    { questionId: string },
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
      newQuestion?: NewQuestion;
      userId: string;
      groupId: string;
    }
  >,
  next: NextFunction
) => {
  const { surveyId } = req.body;
  const currentLang = (req.headers["accept-language"] as "en" | "de") || "en";
  try {
    if (Number.isNaN(+surveyId)) {
      return next(
        new CustomError(
          getTranslation(currentLang, "unexpectedError"),
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
          getTranslation(currentLang, "surveyNotFound"),
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

export const validateNewQuestion = async (
  req: Request<
    { questionId: string },
    {},
    {
      workspaceId: string;
      surveyId: string;
      newQuestion: NewQuestion;
      options: NewQuestionOptions;
    }
  >,
  res: Response<
    {},
    {
      newQuestion: NewQuestion;
      workspaceId: string;
      userId: string;
      groupId: string;
    }
  >,
  next: NextFunction
) => {
  try {
    const data = processQuestionData(req.body);
    const options = processNewQuestionOptions(req.body);
    const schema = genericTextSchema(options);
    schema.parse(data);
    res.locals.newQuestion = { ...data };
    if (data.imageUrl) {
      const imageUrl = makeImage(data.imageUrl);
      res.locals.newQuestion = { ...data, imageUrl };
    }
    next();
  } catch (error) {
    const { headers } = req;
    const currentLang = headers["accept-language"] as "en" | "de";
    if (error instanceof ZodError) {
      next(
        new CustomError(
          "validation Error",
          400,
          true,
          "`validationError`",
          "",
          validateWithSchema(error, currentLang)
        )
      );
    }
    next(error);
  }
};

export const validateEditQuestion = async (
  req: Request<
    { questionId: string },
    {},
    {
      workspaceId: string;
      surveyId: string;
      newQuestion: NewQuestion;
      options: NewQuestionOptions;
      currentEndingType: "default" | "custom";
    }
  >,
  res: Response<
    {},
    {
      newQuestion: editQuestion;
      workspaceId: string;
      userId: string;
      groupId: string;
    }
  >,
  next: NextFunction
) => {
  const currentLang = req.headers["accept-language"] as "en" | "de";
  try {
    const data = processEditQuestionData(req.body);
    const options = processNewQuestionOptions(req.body);
    const schema = editGenericTextSchema(options);
    schema.parse(data);
    res.locals.newQuestion = { ...data };
    if (
      data.imageUrl !== null &&
      data.imageUrl !== undefined &&
      typeof data.imageUrl === "string" &&
      !data.imageUrl.includes("\\uploads\\")
    ) {
      const imageUrl = makeImage(data.imageUrl);
      res.locals.newQuestion = { ...data, imageUrl };
    }
    next();
  } catch (error) {
    const { headers } = req;
    if (error instanceof ZodError) {
      next(
        new CustomError(
          "validation Error",
          400,
          true,
          "`validationError`",
          "",
          validateWithSchema(error, currentLang)
        )
      );
    }
    next(error);
  }
};

export const checkGenericTextExists = async (
  req: Request<
    { questionId: string },
    {},
    {
      workspaceId: string;
      surveyId: string;
      newQuestion: NewQuestion;
      options: NewQuestionOptions;
    }
  >,
  res: Response<
    {},
    {
      newQuestion: NewQuestion;
      workspaceId: string;
      userId: string;
      groupId: string;
      questionId: string;
      question: GenericTextModel;
    }
  >,
  next: NextFunction
) => {
  try {
    const currentLang = req.headers["accept-language"] as "en" | "de";

    const { questionId } = req.params;

    const genericText = await GenericText.findOne({
      where: { id: questionId },
      include: [
        { model: GeneralText, as: "generalText" },
        { model: GeneralRegex, as: "generalRegex" },
      ],
    });

    if (!genericText) {
      return next(
        new CustomError(
          getTranslation(currentLang, "genericTextNotFound"),
          404,
          true,
          "genericTextNotFound"
        )
      );
    }

    const plainGenericText = genericText.get({ plain: true });

    res.locals.question = plainGenericText;

    next();
  } catch (error) {
    return next(error);
  }
};
