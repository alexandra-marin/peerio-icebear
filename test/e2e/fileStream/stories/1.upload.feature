Feature: Uploading
    Uploaded files go directly to a user's drive, and do not enter the file stream (unless shared).

    Background:
        Given I am logged in

    Scenario: Upload a file
        When I upload a file
        Then I will see it in my drive
        But I will not see it in my file stream