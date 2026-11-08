export type LoggedInUser = {
  id: number;
  fullName: string;
  username: string;
  role: "Admin" | "Staff";
  isActive: boolean;
};