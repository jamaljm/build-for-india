export interface FormData {
  formData: {
    fullName: string | null;
    fatherName: string | null;
    motherName: string | null;
    dob: string | null;
    gender: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    pincode: string | null;
    aadharNumber: string | null;
    certificateType: string | null;
  };
  lastUpdated: string | null;
  isComplete: boolean;
}

const STORAGE_KEY = "kerala_gov_cert_form_data";

const MAX_FIELD_LENGTH = 500;

const getDefaultFormData = (): FormData => ({
  formData: {
    fullName: null,
    fatherName: null,
    motherName: null,
    dob: null,
    gender: null,
    email: null,
    phone: null,
    address: null,
    pincode: null,
    aadharNumber: null,
    certificateType: null,
  },
  lastUpdated: null,
  isComplete: false,
});

const sanitizeValue = (value: string): string => {
  return value.trim().slice(0, MAX_FIELD_LENGTH);
};

export const readFormData = (): FormData => {
  try {
    if (typeof window === "undefined") {
      return getDefaultFormData();
    }
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : getDefaultFormData();
  } catch (error) {
    console.error("Error reading form data:", error);
    return getDefaultFormData();
  }
};

export const updateFormData = (
  fieldName: keyof FormData["formData"],
  value: string
): FormData => {
  const currentData = readFormData();

  // Sanitize the input value
  const sanitized = sanitizeValue(value);
  currentData.formData[fieldName] = sanitized;
  currentData.lastUpdated = new Date().toISOString();

  // Check if all required fields are filled with non-empty trimmed strings
  const requiredFields: (keyof FormData["formData"])[] = [
    "fullName",
    "fatherName",
    "motherName",
    "dob",
    "gender",
    "email",
    "phone",
    "address",
    "pincode",
    "aadharNumber",
    "certificateType",
  ];

  currentData.isComplete = requiredFields.every((field) => {
    const val = currentData.formData[field];
    return val !== null && val.trim().length > 0;
  });

  // Save to localStorage
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));

      // Dispatch a custom event so same-tab listeners can react immediately.
      // The native "storage" event only fires in other tabs.
      window.dispatchEvent(
        new CustomEvent("formDataUpdated", {
          detail: { fieldName, value: sanitized, formData: currentData },
        })
      );
    }
  } catch (error) {
    console.error("Error writing form data:", error);
  }

  return currentData;
};

export const resetFormData = (): void => {
  const emptyData = getDefaultFormData();

  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyData));
    }
  } catch (error) {
    console.error("Error resetting form data:", error);
  }
};
