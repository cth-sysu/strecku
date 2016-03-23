== API description (v2) ==

/images - image of what ever is in ?tag=

Token authenticated:
/token - token info
/users - add user (POST)
/stores - add store (POST)

User authenticated:
/users - (admin) all users
/users/:id - (admin/me) one user
/users/:id/password - (me) change password
/users/:id/codes - (me) all my codes, add code
/users/:id/codes/:code - (me) remove code
/products - (admin) all products (GET)
/products/:id - (admin) one product (GET)
/purchases - my purchases across stores (GET)
/purchases/count - number of purchases I've made (GET)
/stores - all stores I have access to {id, name, admin}
/stores/:id - one store {id, name, debt}
/stores/:id/products - items in this store
/stores/:id/purchases - purchase in this store (POST)
/stores/:id/users - (admin) users [{user, debt}]
/stores/:id/accesses - (admin) accesses [{user, level}]

Store authenticated:
/codes/:code - (item/user) item or user in this store
/users - users of this store {id, name, debt}
/users/:id - one user of this store {id, name, debt}
/users/:id/codes - add code (with a previous code as identification)
/products - all items in this store
/products/:id - (admin) one item in this store
/purchases - purchase in this store
/purchases/count - number of purchases in this store (GET)
/stores/:id - (this) - this store info
