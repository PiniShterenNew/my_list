import { IUser } from '../../models/user.model';
import { IList } from '../../models/list.model';

declare global {
  namespace Express {
    interface Request {
      user: IUser & { _id: string };
      list?: IList;
    }
  }
}

export {};