Feature: User account

    User has to be able to create a new account. Use his credentials to log in.
    Also to delete the account, provided confirmed email exists.

    Background:
        Given I create an account

    Scenario: user creates an account
        Then  I am authenticated
        When  I restart
        And   I login
        Then  I am authenticated

    Scenario: user deletes existing account
        Given I confirm my primary email
        Then  My primary email is confirmed
        When  I delete my account
        Then  I am not authenticated
        When  I restart
        Then  I am not able to login
