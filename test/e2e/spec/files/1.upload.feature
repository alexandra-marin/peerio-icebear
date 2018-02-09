@off
Feature: Uploading
    Uploaded files go directly to a user's drive, and do not enter the file stream (unless shared).

    Background:
        Given I create my account

    Scenario: Upload a file
        When I upload a file
        Then I will see it in my drive
