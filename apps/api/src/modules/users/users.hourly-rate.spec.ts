import { PERMISSIONS_KEY } from '../../common/decorators/auth.decorators';
import { UsersController } from './users.controller';

describe('UsersController hourly rate permission', () => {
  it('requires user.manage to create or update a worker rate', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, UsersController.prototype.createUser)).toEqual([
      'user.manage',
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, UsersController.prototype.updateUser)).toEqual([
      'user.manage',
    ]);
  });
});
