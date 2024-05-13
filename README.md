# Express API for Azure tables.
#### By: Yodahea Daniel


##### 1) Project Description
##### 2) Versions List

### 1) Project Description

This is the backend of the family image repository.

- How the website and API interact:
    * The user registers and logs in, the data is sent and authenticated using JWTs in API. 
    * The user inserts, reads, deletes, or updates data, the API does accordingly with an Azure Table housing the data.
    * The user can receive data on image's saved in an Azure Blob like file name, size, file type and can view the images. 

After JWT authentication with the API, is validated the user gains access to interact with data to/from the Azure Table.

 
### 2) Versions List


##### 1.0 <-> Original Release
- API performs Add, view, and delete function for data in a Azure Table.  
- Table like generic class: 'catcher()', 'createTable(), 'insertEntity()', 'listEntities()',  'myGetData()'
- Table: 'users' hold users information. 
- Basic cache route for testing cache data speed using 'express-expeditious'.
- Future Improvement: improve cache route using 'node-cache', add authentication to app

##### 1.1 <-> Authentication Release
- API has route protection using authentication with JWT's.
- Table: 'auth' holds the information of registered users. 
- Table like generic class addition: 'getSingleData()', 'myDeleteData()', 'checkUserExists()'
- Future Improvement: Need to fix 'myGetData()' to be compatible with all types of tables, not just the 'users' table. Also, adding caching to the users authentication information to shorten request speeds.


##### 1.2 <-> Table-Authentication Incorporation Release
- API now houses authentication data in Azure table. 
- Upgraded Table to 'authJWT' to have both a Token and Hashed password column.
- Added a 'logout' function to reset user's auth data when logged out. 
- Added a logger to most of Table function to let user know whats happening in backend for things like token assignment, user registry, etc. 
- Table like generic class addition: 'checkUserPassword()', 'updateToken()', 'updateHashed()', 'provideToken()', 'provideHashed()'.
- Future Improvements: Code cleanup

##### 2.0 / (1.3) <-> UI 'Azure-Table-Repository' Release
- API is now configured for a website project called 'Azure-Data-Repository'.
- API now uses Pusher-js to provide token and Client Data to client in realtime. 
- Changed function to verify JWT's --> 'checkTokenValid'.
 

##### 2.1 <-> Images-Azure Blobs Release
- New route added to API called 'image'.
- In images route, the API now interacts with an Azure Blob storage using a similar tool to 'mytablelike' called 'mybloblike'. 
- The storage holds image file while the API gets image buffer data, lists images in the blob storage, and creates storages for images currently.  
 
##### 2.1.1 <-> Minor Update 1 Release
- Fixed undefined token error and empty 'users' list error.
- Configure 'table/Update' route to match UI

##### 2.2   <-> Node Caching, Auth Process
- Switched to using 'node-cache' and integrated into Tablelike to cache Table data
- Changed Auth process, 1. Function receives token from user 2. CONTENTS of token then compared to the user, 3. If valid, function compares token received to the last viable token distributed to that user
- Other minor bug fixes

##### 2.2.1 <-> Oauth Integration
- Added ANOTHER method to login using Oauth and Azure AD.
- Now option to sign in using Azure AD or local login.
- User will provide Token upon each request that should match token in 'Auth' Azure Table. ( work in prog.)