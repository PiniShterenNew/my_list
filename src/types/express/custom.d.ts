import { Request } from 'express';
import { IUser } from '../models/user.model';
import { IList } from '../models/list.model';

export interface IExtendedRequest extends Request {
  user: IUser & { _id: string };
  list?: IList;
}