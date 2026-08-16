import { Home, Briefcase, Tag } from "lucide-react";

export const LABEL_OPTIONS = ["Home", "Work", "Other"];

export function getLabelIcon(label: string) {
  switch (label.toLowerCase()) {
    case "home":
      return <Home size={14} />;
    case "work":
      return <Briefcase size={14} />;
    default:
      return <Tag size={14} />;
  }
}

export const EMPTY_ADDRESS_FIELDS = {
  flat_house: "",
  building: "",
  street: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};
