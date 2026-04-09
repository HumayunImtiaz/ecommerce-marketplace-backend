import { OAuth2Client } from "google-auth-library";
import { createError } from "./apiResponse";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

type GoogleUser = {
  fullName: string;
  email: string;
  providerId: string;
};

const verifyGoogleToken = async (token: string): Promise<GoogleUser> => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.sub || !payload.name) {
      return Promise.reject(
        createError({
          statusCode: 401,
          success: false,
          message: "Invalid Google token",
          data: null,
        })
      );
    }

    return {
      fullName: payload.name,
      email: payload.email,
      providerId: payload.sub,
    };
  } catch {
    return Promise.reject(
      createError({
        statusCode: 401,
        success: false,
        message: "Invalid Google token",
        data: null,
      })
    );
  }
};

export default verifyGoogleToken;