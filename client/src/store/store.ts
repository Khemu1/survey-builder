import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import surveyReducer from "./slices/surveySlice";
import workspaceReducer from "./slices/workspaceSlice";
import currentWorkspaceReducer from "./slices/currentWorkspaceSlice";
import currentSurveyReducer from "./slices/currentSurveySlice";
import sharedFormReducer from "./slices/sharedFormSlice";
import welcomePageReducer from "./slices/welcomePageSlice";
import genericTextReducer from "./slices/genericTextSlice";
const store = configureStore({
  reducer: {
    auth: authReducer,
    survey: surveyReducer,
    workspace: workspaceReducer,
    currentWorkspace: currentWorkspaceReducer,
    currentSurvey: currentSurveyReducer,
    sharedForm: sharedFormReducer,
    welcomePage: welcomePageReducer,
    genericText: genericTextReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
