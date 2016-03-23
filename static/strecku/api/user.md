## API reference
API has base url `/api/v1`.

## `GET /images`
Get image.

Query:

| Key | Description |
| --- | --- |
| tag | Hashtag |

## `GET /users`
Get user profiles.

Query:

| Key | Description |
| --- | --- |
| search | Text string to seach for user |
| limit | Number of users in result |
| offset | Offset of result |

Response:

| Key | Description |
| --- | --- |
| users | Array of user profiles |
| next | Link to next page if available |

## `GET /users/:id`
Get a user profile.

Response:

| Key | Description |
| --- | --- |
| _id | User id |
| name | Full name |

## `GET /users/me`
Get authenticated user's profile.

Response:

| Key | Description |
| --- | --- |
| _id | User id |
| name | Full name |
| email | Email address |

## `PUT /users/me`
Set user's name.

Body:

| Key | Description |
| --- | --- |
| name | Full name |

## `GET /users/me/codes`
Get user's associated codes.

Response:

| Key | Description |
| --- | --- |
| codes | Array of codes |

## `POST /users/me/codes`
Associate a code with the user.

Body:

| Key | Description |
| --- | --- |
| code | Code to add |

## `DELETE /users/me/codes/:code`
Remove a code to from the user.

## `GET /products`
Get products from the product database.

Query:

| Key | Description |
| --- | --- |
| search | Text string to seach for product |
| limit | Number of products in result |
| offset | Offset of result |

Response:

| Key | Description |
| --- | --- |
| products | Array of products |
| next | Link to next page if available |

## `GET /products/:id`
Get a product.

Response:

| Key | Description |
| --- | --- |
| _id | Product id |
| name | Primary name |
| category | Category |
| metadata | Object with metadata mappings |
| barcodes | Array of associated barcodes |

## `GET /purchases`
Get authenticated user's purchases.

Query:

| Key | Description |
| --- | --- |
| product | Product id filter |
| store | Store id filter |
| limit | Number of purchases in result |
| offset | Offset of result |

Response:

| Key | Description |
| --- | --- |
| purchases | Array of purchases |
| next | Link to next page if available |

## `GET /purchases/count`
Get number of purchases for the authenticated user.

Query:

| Key | Description |
| --- | --- |
| product | Product id filter |
| store | Store id filter |

Response:

| Key | Description |
| --- | --- |
| count | Number of purchases |

## `GET /stores`
Get authenticated user's accessible stores.

Query:

| Key | Description |
| --- | --- |
| limit | Number of purchases in result |
| offset | Offset of result |

Response:

| Key | Description |
| --- | --- |
| stores | Array of stores |
| next | Link to next page if available |

## `GET /stores/:id`
Get a store.

Response:

| Key | Description |
| --- | --- |
| _id | Store id |
| name | Store name |
| metadata | Store metadata |
| debt | Current balance for this store |
| purchases | Object with purchase statistics |
| admin | If this this user is admin for the store |

Purchase statistics:

| Key | Description |
| --- | --- |
| count | Number of purchases in this store |
| products | Number of total proucts bought through this store |
| latest | Date of latest purchase in this store |

## `GET /stores/:id/products`
Get products available in this store.

Response:

| Key | Description |
| --- | --- |
| products | Array of store products |

Product:

| Key | Description |
| --- | --- |
| _id | Product id |
| name | Primary name |
| category | Category |
| metadata | Object with metadata mappings |
| barcodes | Array of associated barcodes |
| popularity | Popularity for user as number in range 0.0 - 1.0 |
| price | Cost of product |

## `POST /stores/:id/purchases`
Make a purchase in this store.

Body:

| Key | Description |
| --- | --- |
| product | Product id |
| amount | Quantity of the product in this purchase |
| user | User id (admin only) |
| price | Custom price (admin only) |

## Store Admin endpoints

## `PUT /stores/:id`
Edit store name and metadata.

Body:

| Key | Description |
| --- | --- |
| name | Store name |
| * | Any extra property will be set on the store's metadata |

## `GET /stores/:id/users`
Get user with debt or access to this store.

Query:

| Key | Description |
| --- | --- |
| search | Text string to seach for user |

Response:

| Key | Description |
| --- | --- |
| users | Array of store users |

## `GET /stores/:id/accesses`
Get users with access to this store.

Response:

| Key | Description |
| --- | --- |
| accesses | Array of store users |

## `POST /stores/:id/accesses`
Add user accesss to this store.

Body:

| Key | Description |
| --- | --- |
| user | User id |
| level | Access level for this user |
| admin | (true|false) If user is admin |

## `GET /stores/:id/accesses/:id`
Get user access to this store.

Response:

| Key | Description |
| --- | --- |
| _id | User id |
| name | User's full name |
| email | User's email |
| level | User's access level |
| admin | If user has admin access |

## `DELETE /stores/:id/accesses/:id`
Remove user accesss to this store.

## `POST /stores/:id/products`
Add product to this store's inventory.

Body:

| Key | Description |
| --- | --- |
| product or name | Product id or name of new product |
| pricelevels | Array of pricelevels for this product |
| available | (true|false) Item availablility |

## `GET /stores/:id/products/:id`
Get product in this store.

Product:

| Key | Description |
| --- | --- |
| _id | Product id |
| name | Primary name |
| category | Category |
| metadata | Object with metadata mappings |
| barcodes | Array of associated barcodes |
| pricelevels | Array of pricelevels for this product |
| available | Availability of this product |

## `PUT /stores/:id/products/:id`
Edit product in this store.

Body:

| Key | Description |
| --- | --- |
| pricelevels | Array of pricelevels for this product |
| available | (true|false) Item availablility |

## `DELETE /stores/:id/products/:id`
Remove a product from this store.

## `GET /stores/:id/purchases`
Get purchases in this store.

Query:

| Key | Description |
| --- | --- |
| product | Product id filter |
| user | User id filter |
| limit | Number of purchases in result |
| offset | Offset of result |

Response:

| Key | Description |
| --- | --- |
| purchases | Array of purchases |
| next | Link to next page if available |

## `DELETE /stores/:id/purchases/:id`
Remove a purchase from this store.

## `GET /stores/:id/purchases/count`
Get number of purchases in this store.

Query:

| Key | Description |
| --- | --- |
| product | Product id filter |
| user | User id filter |

Response:

| Key | Description |
| --- | --- |
| count | Number of purchases |

## `GET /stores/:id/webhooks`
Get the webhooks registered for this store.

Response:

| Key | Description |
| --- | --- |
| webhooks | Array of webhooks |

## `POST /stores/:id/webhooks`
Register a webhook for this store.

Body:

| Key | Description |
| --- | --- |
| action | Type of event ('purchase') |
| name | Name of the webhook |
| url | POST url for the webhook |
| headers | Object hash with headers to put on the request (optional) |
| template | Object template to send as body instead of the purchase. Purchase will be projected onto string properties using handlebars syntax (optional) |

Example template for a Slack-hook:
```
"template" : {
    "icon_emoji" : ":ghost:",
    "text" : "{{user.name}} bought (x{{amount}}) {{product.name}} <!date^{{time}}^ ({time})| >"
}
```
