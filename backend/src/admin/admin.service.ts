import { Injectable } from "@nestjs/common";
import { UsersService } from "../users/users.service";

@Injectable()
export class AdminService {
  constructor(private users: UsersService) {}
  getAllUsers() { return this.users.findAll(); }
  approveUser(id: string) { return this.users.updateStatus(id, "APPROVED"); }
  rejectUser(id: string) { return this.users.updateStatus(id, "REJECTED"); }
  suspendUser(id: string) { return this.users.updateStatus(id, "SUSPENDED"); }
}
