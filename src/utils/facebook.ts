import axios from "axios";
import { createError } from "./apiResponse";

type FacebookUser = {
  fullName: string;
  email: string;
  providerId: string;
};

export const verifyFacebookToken = async (
  token: string
): Promise<FacebookUser> => {
  try {
    const response = await axios.get("https://graph.facebook.com/me", {
      params: {
        fields: "id,name,email",
        access_token: token,
      },
    });

    const { id, name, email } = response.data;

    if (!id || !name || !email) {
      return Promise.reject(
        createError({
          statusCode: 400,
          success: false,
          message: "Unable to verify Facebook user",
          data: null,
        })
      );
    }

    return {
      fullName: name,
      email,
      providerId: id,
    };
  } catch {
    return Promise.reject(
      createError({
        statusCode: 400,
        success: false,
        message: "Invalid Facebook token",
        data: null,
      })
    );
  }
};