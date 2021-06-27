Feature: Admin scene

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'admin_scene'

  Scenario: I can see main admin scene
    Then Bot responds '👇'
    Then Bot responds '*Админка*'