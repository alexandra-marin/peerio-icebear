Feature: Digest

    Testing some tricky aspects of digest.
    Digest is normally tested during any other Cucumbot scenarios,
    but this set of scenarios is supposed to test edge cases.

    @BOT_NO_ACCOUNT_test_multi_client_diges
    Scenario: Digest sync with multiple clients of same user
        Given I create my account
        And   I send my credentials to Cucumbot
        And   Cucumbot logs in
        When  I start a DM with Cucumbot
        And   I send a message "Hi, Cucumbot!"
        Then  Cucumbot receives own message "Hi, Cucumbot!"
        When  Cucumbot sends a message "Hello, stranger."
        Then  I receive own message "Hello, stranger."
        When  I restart without login
        And   Cucumbot sends a message "I see you are offline."
        And   Cucumbot restarts
        And   I login
        And   Cucumbot starts a DM with me
        Then  Cucumbot receives own message "Hi, Cucumbot!"
        And   I receive own message "Hello, stranger."
        And   I receive own message "I see you are offline."
