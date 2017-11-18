Feature: User account

    User has to be able to create a new account. Use his credentials to log in.
    Also to delete the account, provided confirmed email exists.

    Scenario: user creates an account
        # this action should create random username account and store credentials in the current world
        When  I create an account
        Then  I am authenticated
        # should emulate app restart by closing connections and clearing caches
        When  I restart
        # should use world account credentials
        And   I login
        Then  I am authenticated

    @wip
    Scenario: user deletes existing account
        # create account, wait for login
        Given I am authenticated
        # add and confirm email
        And   I have a confirmed email
        When  I delete my account
        Then  I am not able to login
